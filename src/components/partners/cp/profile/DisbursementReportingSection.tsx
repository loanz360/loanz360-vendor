'use client'

import React, { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type {
  CPLenderAssociation,
  CPReportingConfig,
  LoanProductType,
} from '@/types/cp-profile'
import { LOAN_PRODUCT_LABELS } from '@/types/cp-profile'
import { toast } from 'sonner'

interface DisbursementReportingSectionProps {
  lenderAssociations: CPLenderAssociation[]
  reportingConfig: CPReportingConfig
  onSubmitDisbursement: (data: DisbursementFormData) => Promise<void>
  onBulkUpload: (file: File, lenderAssociationId: string) => Promise<BulkUploadResult>
}

interface DisbursementFormData {
  lender_association_id: string
  loan_account_number: string
  customer_name: string
  co_applicant_name?: string
  disbursement_date: string
  disbursement_amount: number
  product_type: LoanProductType
  property_location?: string
  loan_tenure_months?: number
  roi?: number
}

interface BulkUploadResult {
  success: boolean
  total_records: number
  validated: number
  rejected: number
  errors: Array<{ row: number; field: string; error: string }>
}

export default function DisbursementReportingSection({
  lenderAssociations,
  reportingConfig,
  onSubmitDisbursement,
  onBulkUpload,
}: DisbursementReportingSectionProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<DisbursementFormData>({
    lender_association_id: '',
    loan_account_number: '',
    customer_name: '',
    co_applicant_name: '',
    disbursement_date: '',
    disbursement_amount: 0,
    product_type: 'HOME_LOAN',
    property_location: '',
    loan_tenure_months: undefined,
    roi: undefined,
  })

  const [selectedLenderId, setSelectedLenderId] = useState('')

  const activeLenders = lenderAssociations.filter((la) => la.code_status === 'ACTIVE')

  const handleInputChange = (field: keyof DisbursementFormData, value: string | number | boolean | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validateForm = (): boolean => {
    if (!formData.lender_association_id) {
      toast.error('Please select a lender')
      return false
    }
    if (!formData.loan_account_number) {
      toast.error('Loan account number is required')
      return false
    }
    if (!formData.customer_name) {
      toast.error('Customer name is required')
      return false
    }
    if (!formData.disbursement_date) {
      toast.error('Disbursement date is required')
      return false
    }
    if (!formData.disbursement_amount || formData.disbursement_amount <= 0) {
      toast.error('Valid disbursement amount is required')
      return false
    }
    if (!formData.product_type) {
      toast.error('Product type is required')
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    try {
      setSubmitting(true)
      await onSubmitDisbursement(formData)
      toast.success('Disbursement submitted successfully')
      // Reset form
      setFormData({
        lender_association_id: formData.lender_association_id,
        loan_account_number: '',
        customer_name: '',
        co_applicant_name: '',
        disbursement_date: '',
        disbursement_amount: 0,
        product_type: 'HOME_LOAN',
        property_location: '',
        loan_tenure_months: undefined,
        roi: undefined,
      })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!selectedLenderId) {
      toast.error('Please select a lender first')
      return
    }

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV or Excel file')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    try {
      setUploading(true)
      setUploadResult(null)
      const result = await onBulkUpload(file, selectedLenderId)
      setUploadResult(result)

      if (result.validated > 0) {
        toast.success(`${result.validated} disbursements uploaded successfully`)
      }
      if (result.rejected > 0) {
        toast.warning(`${result.rejected} records were rejected`)
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const downloadTemplate = () => {
    window.open('/api/partners/cp/disbursements/bulk-upload', '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Configuration Info */}
      <Card className="border-gray-700/50 bg-gray-800/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-primary" />
            Reporting Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-500 text-xs">Reporting Method</p>
              <p className="text-white">
                {reportingConfig.reporting_method === 'MANUAL_ENTRY'
                  ? 'Manual Entry'
                  : reportingConfig.reporting_method === 'FILE_UPLOAD'
                    ? 'File Upload'
                    : 'API Integration'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">SLA (Days)</p>
              <p className="text-white">{reportingConfig.reporting_sla_days} days</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Late Penalty</p>
              <p className="text-white">
                {reportingConfig.late_submission_penalty_percentage > 0
                  ? `${reportingConfig.late_submission_penalty_percentage}%`
                  : 'None'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Accepted Formats</p>
              <p className="text-white">{reportingConfig.accepted_file_formats.join(', ').toUpperCase()}</p>
            </div>
          </div>

          {/* Auto Rejection Summary */}
          {reportingConfig.auto_rejection_summary && (
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <p className="text-gray-400 text-sm mb-2">
                Auto-Rejection Summary ({reportingConfig.auto_rejection_summary.period})
              </p>
              <div className="flex flex-wrap gap-3">
                {reportingConfig.auto_rejection_summary.duplicate_entries > 0 && (
                  <Badge className="bg-red-500/20 text-red-400">
                    {reportingConfig.auto_rejection_summary.duplicate_entries} Duplicates
                  </Badge>
                )}
                {reportingConfig.auto_rejection_summary.invalid_loan_numbers > 0 && (
                  <Badge className="bg-red-500/20 text-red-400">
                    {reportingConfig.auto_rejection_summary.invalid_loan_numbers} Invalid Loan #s
                  </Badge>
                )}
                {reportingConfig.auto_rejection_summary.missing_mandatory_fields > 0 && (
                  <Badge className="bg-red-500/20 text-red-400">
                    {reportingConfig.auto_rejection_summary.missing_mandatory_fields} Missing Fields
                  </Badge>
                )}
                {reportingConfig.auto_rejection_summary.other_errors > 0 && (
                  <Badge className="bg-red-500/20 text-red-400">
                    {reportingConfig.auto_rejection_summary.other_errors} Other Errors
                  </Badge>
                )}
                {reportingConfig.auto_rejection_summary.duplicate_entries === 0 &&
                  reportingConfig.auto_rejection_summary.invalid_loan_numbers === 0 &&
                  reportingConfig.auto_rejection_summary.missing_mandatory_fields === 0 &&
                  reportingConfig.auto_rejection_summary.other_errors === 0 && (
                    <Badge className="bg-green-500/20 text-green-400">No Rejections</Badge>
                  )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tab Selector */}
      <div className="flex gap-2 border-b border-gray-700/50 pb-2">
        <Button
          variant={activeTab === 'manual' ? 'default' : 'ghost'}
          className={cn(
            activeTab === 'manual'
              ? 'bg-brand-primary hover:bg-brand-primary/90'
              : 'text-gray-400 hover:text-white'
          )}
          onClick={() => setActiveTab('manual')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Manual Entry
        </Button>
        <Button
          variant={activeTab === 'upload' ? 'default' : 'ghost'}
          className={cn(
            activeTab === 'upload'
              ? 'bg-brand-primary hover:bg-brand-primary/90'
              : 'text-gray-400 hover:text-white'
          )}
          onClick={() => setActiveTab('upload')}
        >
          <Upload className="w-4 h-4 mr-2" />
          Bulk Upload
        </Button>
      </div>

      {/* Manual Entry Form */}
      {activeTab === 'manual' && (
        <Card className="border-gray-700/50 bg-gray-800/50">
          <CardHeader>
            <CardTitle className="text-lg">Submit Disbursement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {activeLenders.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                <p className="text-white font-medium">No Active Lender Codes</p>
                <p className="text-gray-400 text-sm mt-1">
                  You need at least one active lender code to submit disbursements.
                </p>
              </div>
            ) : (
              <>
                {/* Lender Selection */}
                <div>
                  <Label className="text-gray-300">Select Lender *</Label>
                  <Select
                    value={formData.lender_association_id}
                    onValueChange={(value) => handleInputChange('lender_association_id', value)}
                  >
                    <SelectTrigger className="bg-gray-900/50 border-gray-700 mt-1">
                      <SelectValue placeholder="Select Bank/NBFC" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeLenders.map((la) => (
                        <SelectItem key={la.id} value={la.id}>
                          {la.lender_name} ({la.loans360_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Form Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Loan Account Number *</Label>
                    <Input
                      className="bg-gray-900/50 border-gray-700 mt-1"
                      value={formData.loan_account_number}
                      onChange={(e) =>
                        handleInputChange('loan_account_number', e.target.value.toUpperCase())
                      }
                      placeholder="Enter loan account number"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300">Customer Name *</Label>
                    <Input
                      className="bg-gray-900/50 border-gray-700 mt-1"
                      value={formData.customer_name}
                      onChange={(e) => handleInputChange('customer_name', e.target.value)}
                      placeholder="Enter customer name"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300">Co-Applicant Name</Label>
                    <Input
                      className="bg-gray-900/50 border-gray-700 mt-1"
                      value={formData.co_applicant_name}
                      onChange={(e) => handleInputChange('co_applicant_name', e.target.value)}
                      placeholder="Enter co-applicant name (if any)"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300">Disbursement Date *</Label>
                    <Input
                      type="date"
                      className="bg-gray-900/50 border-gray-700 mt-1"
                      value={formData.disbursement_date}
                      onChange={(e) => handleInputChange('disbursement_date', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300">Disbursement Amount (₹) *</Label>
                    <Input
                      type="number"
                      className="bg-gray-900/50 border-gray-700 mt-1"
                      value={formData.disbursement_amount || ''}
                      onChange={(e) =>
                        handleInputChange('disbursement_amount', parseFloat(e.target.value) || 0)
                      }
                      placeholder="Enter amount"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300">Product Type *</Label>
                    <Select
                      value={formData.product_type}
                      onValueChange={(value) =>
                        handleInputChange('product_type', value as LoanProductType)
                      }
                    >
                      <SelectTrigger className="bg-gray-900/50 border-gray-700 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LOAN_PRODUCT_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-gray-300">Property Location</Label>
                    <Input
                      className="bg-gray-900/50 border-gray-700 mt-1"
                      value={formData.property_location}
                      onChange={(e) => handleInputChange('property_location', e.target.value)}
                      placeholder="City/Location"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300">Loan Tenure (Months)</Label>
                    <Input
                      type="number"
                      className="bg-gray-900/50 border-gray-700 mt-1"
                      value={formData.loan_tenure_months || ''}
                      onChange={(e) =>
                        handleInputChange('loan_tenure_months', parseInt(e.target.value) || undefined)
                      }
                      placeholder="e.g., 240"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300">ROI (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="bg-gray-900/50 border-gray-700 mt-1"
                      value={formData.roi || ''}
                      onChange={(e) =>
                        handleInputChange('roi', parseFloat(e.target.value) || undefined)
                      }
                      placeholder="e.g., 8.5"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <Button
                    className="bg-brand-primary hover:bg-brand-primary/90"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Submit Disbursement
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk Upload */}
      {activeTab === 'upload' && (
        <Card className="border-gray-700/50 bg-gray-800/50">
          <CardHeader>
            <CardTitle className="text-lg">Bulk Upload Disbursements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {activeLenders.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                <p className="text-white font-medium">No Active Lender Codes</p>
                <p className="text-gray-400 text-sm mt-1">
                  You need at least one active lender code to upload disbursements.
                </p>
              </div>
            ) : (
              <>
                {/* Lender Selection */}
                <div>
                  <Label className="text-gray-300">Select Lender *</Label>
                  <Select value={selectedLenderId} onValueChange={setSelectedLenderId}>
                    <SelectTrigger className="bg-gray-900/50 border-gray-700 mt-1">
                      <SelectValue placeholder="Select Bank/NBFC for upload" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeLenders.map((la) => (
                        <SelectItem key={la.id} value={la.id}>
                          {la.lender_name} ({la.loans360_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Upload Area */}
                <div
                  className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                    selectedLenderId
                      ? 'border-gray-600 hover:border-brand-primary cursor-pointer'
                      : 'border-gray-700 cursor-not-allowed opacity-50'
                  )}
                  onClick={() => selectedLenderId && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={!selectedLenderId || uploading}
                  />

                  {uploading ? (
                    <div>
                      <Loader2 className="w-12 h-12 text-brand-primary mx-auto animate-spin" />
                      <p className="text-white mt-4">Processing file...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                      <p className="text-white mt-4">
                        {selectedLenderId
                          ? 'Click to upload or drag and drop'
                          : 'Select a lender first'}
                      </p>
                      <p className="text-gray-400 text-sm mt-2">
                        CSV or Excel file (max 5MB, up to 1000 records)
                      </p>
                    </>
                  )}
                </div>

                {/* Download Template */}
                <div className="flex justify-center">
                  <Button variant="outline" className="border-gray-600" onClick={downloadTemplate}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                </div>

                {/* Upload Result */}
                {uploadResult && (
                  <div
                    className={cn(
                      'p-4 rounded-lg border',
                      uploadResult.rejected === 0
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-yellow-500/10 border-yellow-500/30'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {uploadResult.rejected === 0 ? (
                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-yellow-400" />
                      )}
                      <span className="text-white font-medium">Upload Complete</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Total Records</p>
                        <p className="text-white font-semibold">{uploadResult.total_records}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Validated</p>
                        <p className="text-green-400 font-semibold">{uploadResult.validated}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Rejected</p>
                        <p className="text-red-400 font-semibold">{uploadResult.rejected}</p>
                      </div>
                    </div>

                    {uploadResult.errors.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-700/50">
                        <p className="text-yellow-400 text-sm font-medium mb-2">Rejection Details:</p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {uploadResult.errors.slice(0, 10).map((error, index) => (
                            <p key={index} className="text-gray-300 text-xs">
                              Row {error.row}: {error.field} - {error.error}
                            </p>
                          ))}
                          {uploadResult.errors.length > 10 && (
                            <p className="text-gray-500 text-xs">
                              ... and {uploadResult.errors.length - 10} more errors
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
