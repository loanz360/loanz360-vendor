'use client'

import React, { useState, useRef } from 'react'
import {
  CreditCard,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  User,
  Phone,
  Mail
} from 'lucide-react'

interface PanCardModalProps {
  isOpen: boolean
  onClose: () => void
  onPanSaved: (panNumber: string) => void
}

interface FormData {
  panNumber: string
  fullName: string
  fatherName: string
  mobileNumber: string
  emailId: string
}

interface FormErrors {
  panNumber: string
  fullName: string
  fatherName: string
  mobileNumber: string
  emailId: string
}

type InputMode = 'choice' | 'manual' | 'upload'

export default function PanCardModal({ isOpen, onPanSaved }: PanCardModalProps) {
  const [mode, setMode] = useState<InputMode>('choice')
  const [formData, setFormData] = useState<FormData>({
    panNumber: '',
    fullName: '',
    fatherName: '',
    mobileNumber: '',
    emailId: ''
  })
  const [formErrors, setFormErrors] = useState<FormErrors>({
    panNumber: '',
    fullName: '',
    fatherName: '',
    mobileNumber: '',
    emailId: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // PAN format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
  const validatePan = (pan: string): boolean => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
    return panRegex.test(pan.toUpperCase())
  }

  // Mobile: 10 digits starting with 6-9
  const validateMobile = (mobile: string): boolean => {
    const mobileRegex = /^[6-9][0-9]{9}$/
    return mobileRegex.test(mobile)
  }

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Name validation: letters and spaces only, min 2 characters
  const validateName = (name: string): boolean => {
    const nameRegex = /^[A-Za-z\s]{2,}$/
    return nameRegex.test(name.trim())
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    let processedValue = value

    if (field === 'panNumber') {
      processedValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
    } else if (field === 'mobileNumber') {
      processedValue = value.replace(/[^0-9]/g, '').slice(0, 10)
    } else if (field === 'fullName' || field === 'fatherName') {
      processedValue = value.replace(/[^A-Za-z\s]/g, '')
    }

    setFormData(prev => ({ ...prev, [field]: processedValue }))
    setFormErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validateForm = (): boolean => {
    const errors: FormErrors = {
      panNumber: '',
      fullName: '',
      fatherName: '',
      mobileNumber: '',
      emailId: ''
    }
    let isValid = true

    if (!validatePan(formData.panNumber)) {
      errors.panNumber = 'Invalid PAN format. Expected: ABCDE1234F'
      isValid = false
    }

    if (!validateName(formData.fullName)) {
      errors.fullName = 'Please enter a valid name (letters only, min 2 characters)'
      isValid = false
    }

    if (!validateName(formData.fatherName)) {
      errors.fatherName = 'Please enter a valid name (letters only, min 2 characters)'
      isValid = false
    }

    if (!validateMobile(formData.mobileNumber)) {
      errors.mobileNumber = 'Please enter a valid 10-digit mobile number starting with 6-9'
      isValid = false
    }

    if (!validateEmail(formData.emailId)) {
      errors.emailId = 'Please enter a valid email address'
      isValid = false
    }

    setFormErrors(errors)
    return isValid
  }

  const isFormComplete = (): boolean => {
    return (
      formData.panNumber.length === 10 &&
      formData.fullName.trim().length >= 2 &&
      formData.fatherName.trim().length >= 2 &&
      formData.mobileNumber.length === 10 &&
      formData.emailId.includes('@')
    )
  }

  const handleManualSubmit = async () => {
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/customers/pan/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pan_number: formData.panNumber.toUpperCase(),
          full_name: formData.fullName.trim(),
          father_name: formData.fatherName.trim(),
          mobile_number: formData.mobileNumber,
          email_id: formData.emailId.trim().toLowerCase()
        })
      })

      const data = await response.json()

      if (data.success) {
        onPanSaved(formData.panNumber.toUpperCase())
        resetForm()
      } else {
        setFormErrors(prev => ({ ...prev, panNumber: data.error || 'Failed to save details' }))
      }
    } catch {
      setFormErrors(prev => ({ ...prev, panNumber: 'Network error. Please try again.' }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please upload a JPEG, PNG, WebP, or PDF file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must be less than 10MB')
      return
    }

    setUploadedFile(file)
    setUploadError('')
  }

  const handleFileUpload = async () => {
    if (!uploadedFile) {
      setUploadError('Please select a file first')
      return
    }

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setUploadError('')
    setUploadProgress(0)

    try {
      // First, save the PAN and other details
      const panResponse = await fetch('/api/customers/pan/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pan_number: formData.panNumber.toUpperCase(),
          full_name: formData.fullName.trim(),
          father_name: formData.fatherName.trim(),
          mobile_number: formData.mobileNumber,
          email_id: formData.emailId.trim().toLowerCase()
        })
      })

      const panData = await panResponse.json()
      if (!panData.success) {
        setUploadError(panData.error || 'Failed to save details')
        setIsSubmitting(false)
        return
      }

      setUploadProgress(30)

      // Then upload the document
      const uploadFormData = new FormData()
      uploadFormData.append('file', uploadedFile)
      uploadFormData.append('document_type', 'PAN')
      uploadFormData.append('document_name', 'PAN Card')

      const uploadResponse = await fetch('/api/customers/documents', {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData
      })

      setUploadProgress(70)

      const uploadData = await uploadResponse.json()

      if (uploadData.success) {
        setUploadProgress(100)
        onPanSaved(formData.panNumber.toUpperCase())
        resetForm()
      } else {
        setUploadError(uploadData.error || 'Failed to upload document')
      }
    } catch {
      setUploadError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setMode('choice')
    setFormData({
      panNumber: '',
      fullName: '',
      fatherName: '',
      mobileNumber: '',
      emailId: ''
    })
    setFormErrors({
      panNumber: '',
      fullName: '',
      fatherName: '',
      mobileNumber: '',
      emailId: ''
    })
    setUploadedFile(null)
    setUploadProgress(0)
    setUploadError('')
  }

  const renderFormFields = () => (
    <div className="space-y-4">
      {/* PAN Number */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">
          <CreditCard className="w-4 h-4 inline mr-2" />
          PAN Number <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={formData.panNumber}
          onChange={(e) => handleInputChange('panNumber', e.target.value)}
          placeholder="ABCDE1234F"
          maxLength={10}
          className={`w-full bg-zinc-800 border ${
            formErrors.panNumber ? 'border-red-500' : 'border-gray-700 focus:border-orange-500'
          } rounded-lg px-4 py-3 text-white text-lg tracking-widest uppercase placeholder-gray-500 focus:outline-none transition-colors`}
          disabled={isSubmitting}
        />
        {formErrors.panNumber && (
          <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {formErrors.panNumber}
          </p>
        )}
      </div>

      {/* Full Name */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">
          <User className="w-4 h-4 inline mr-2" />
          Full Name (as per PAN) <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={formData.fullName}
          onChange={(e) => handleInputChange('fullName', e.target.value)}
          placeholder="Enter your full name"
          className={`w-full bg-zinc-800 border ${
            formErrors.fullName ? 'border-red-500' : 'border-gray-700 focus:border-orange-500'
          } rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors`}
          disabled={isSubmitting}
        />
        {formErrors.fullName && (
          <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {formErrors.fullName}
          </p>
        )}
      </div>

      {/* Father&apos;s Name */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">
          <User className="w-4 h-4 inline mr-2" />
          Father&apos;s Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={formData.fatherName}
          onChange={(e) => handleInputChange('fatherName', e.target.value)}
          placeholder="Enter Father&apos;s Name"
          className={`w-full bg-zinc-800 border ${
            formErrors.fatherName ? 'border-red-500' : 'border-gray-700 focus:border-orange-500'
          } rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors`}
          disabled={isSubmitting}
        />
        {formErrors.fatherName && (
          <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {formErrors.fatherName}
          </p>
        )}
      </div>

      {/* Mobile Number */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">
          <Phone className="w-4 h-4 inline mr-2" />
          Mobile Number <span className="text-red-400">*</span>
        </label>
        <input
          type="tel"
          value={formData.mobileNumber}
          onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
          placeholder="10-digit mobile number"
          maxLength={10}
          className={`w-full bg-zinc-800 border ${
            formErrors.mobileNumber ? 'border-red-500' : 'border-gray-700 focus:border-orange-500'
          } rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors`}
          disabled={isSubmitting}
        />
        {formErrors.mobileNumber && (
          <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {formErrors.mobileNumber}
          </p>
        )}
      </div>

      {/* Email ID */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">
          <Mail className="w-4 h-4 inline mr-2" />
          Email ID <span className="text-red-400">*</span>
        </label>
        <input
          type="email"
          value={formData.emailId}
          onChange={(e) => handleInputChange('emailId', e.target.value)}
          placeholder="your@email.com"
          className={`w-full bg-zinc-800 border ${
            formErrors.emailId ? 'border-red-500' : 'border-gray-700 focus:border-orange-500'
          } rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors`}
          disabled={isSubmitting}
        />
        {formErrors.emailId && (
          <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {formErrors.emailId}
          </p>
        )}
      </div>
    </div>
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl border border-orange-500/30 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">PAN Card Required</h2>
              <p className="text-orange-100 text-sm">To fetch your credit report</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-blue-300 text-sm">
              All fields are mandatory. Your details are required to fetch your credit report from CIBIL.
              This helps us show you all your existing loans and credit score.
            </p>
          </div>

          {mode === 'choice' && (
            <div className="space-y-4">
              <p className="text-gray-400 text-center mb-6">Choose how to provide your PAN details:</p>

              {/* Option 1: Enter PAN Manually */}
              <button
                onClick={() => setMode('manual')}
                className="w-full bg-zinc-800 hover:bg-zinc-700 border border-gray-700 hover:border-orange-500/50 rounded-xl p-4 flex items-center gap-4 transition-all group"
              >
                <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
                  <FileText className="w-6 h-6 text-orange-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-white font-semibold">Enter PAN Number</h3>
                  <p className="text-gray-400 text-sm">Type your 10-digit PAN manually</p>
                </div>
              </button>

              {/* Option 2: Upload PAN Document */}
              <button
                onClick={() => setMode('upload')}
                className="w-full bg-zinc-800 hover:bg-zinc-700 border border-gray-700 hover:border-orange-500/50 rounded-xl p-4 flex items-center gap-4 transition-all group"
              >
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                  <Upload className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-white font-semibold">Upload PAN Card</h3>
                  <p className="text-gray-400 text-sm">Upload image or PDF of your PAN card</p>
                </div>
              </button>
            </div>
          )}

          {mode === 'manual' && (
            <div className="space-y-6">
              <button
                onClick={() => setMode('choice')}
                className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
              >
                Back to options
              </button>

              {renderFormFields()}

              <button
                onClick={handleManualSubmit}
                disabled={!isFormComplete() || isSubmitting}
                className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
                  isFormComplete() && !isSubmitting
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Save & Fetch Credit Report
                  </>
                )}
              </button>
            </div>
          )}

          {mode === 'upload' && (
            <div className="space-y-6">
              <button
                onClick={() => setMode('choice')}
                className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
              >
                Back to options
              </button>

              {renderFormFields()}

              {/* File Upload Area */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  PAN Card Document <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isSubmitting}
                />

                {!uploadedFile ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="w-full border-2 border-dashed border-gray-700 hover:border-orange-500/50 rounded-lg p-6 flex flex-col items-center gap-2 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-gray-500" />
                    <p className="text-gray-400 text-sm">Click to upload PAN card</p>
                    <p className="text-gray-500 text-xs">JPEG, PNG, WebP, or PDF (max 10MB)</p>
                  </button>
                ) : (
                  <div className="bg-zinc-800 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium truncate max-w-[200px]">
                            {uploadedFile.name}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {(uploadedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setUploadedFile(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-red-400 transition-colors text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="mt-3">
                        <div className="w-full bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-orange-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {uploadError && (
                  <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {uploadError}
                  </p>
                )}
              </div>

              <button
                onClick={handleFileUpload}
                disabled={!isFormComplete() || isSubmitting}
                className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
                  isFormComplete() && !isSubmitting
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {uploadProgress > 0 ? `Uploading... ${uploadProgress}%` : 'Processing...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    {uploadedFile ? 'Save & Upload Document' : 'Save Details'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
