'use client'

/**
 * MFA Setup Wizard
 * Step-by-step multi-factor authentication enrollment
 * Supports: TOTP (Authenticator App), SMS, Email, Backup Codes
 */

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mfaService, TOTPService, type MFAMethodType } from '@/lib/security/mfa-service'
import {
  Shield,
  Smartphone,
  Mail,
  Key,
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  Download,
  AlertCircle,
  CheckCircle,
  Loader2,
  QrCode,
  X
} from 'lucide-react'

// ==================== TYPES ====================

type SetupStep = 'method-selection' | 'totp-setup' | 'sms-setup' | 'email-setup' | 'verify' | 'backup-codes' | 'complete'

interface TOTPSetupData {
  secret: string
  qrCodeUrl: string
  manualEntry: string
}

interface SMSSetupData {
  phoneNumber: string
  verificationCode: string
}

interface EmailSetupData {
  email: string
  verificationCode: string
}

interface BackupCodesData {
  codes: string[]
}

// ==================== COMPONENT ====================

export default function MFASetupWizard({ onComplete }: { onComplete?: () => void }) {
  const supabase = createClient()
  const [currentStep, setCurrentStep] = useState<SetupStep>('method-selection')
  const [selectedMethod, setSelectedMethod] = useState<MFAMethodType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // User info
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Setup data
  const [totpData, setTotpData] = useState<TOTPSetupData | null>(null)
  const [smsData, setSmsData] = useState<SMSSetupData>({ phoneNumber: '', verificationCode: '' })
  const [emailData, setEmailData] = useState<EmailSetupData>({ email: '', verificationCode: '' })
  const [verificationCode, setVerificationCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<BackupCodesData | null>(null)

  // UI state
  const [copied, setCopied] = useState(false)
  const [setupMethodId, setSetupMethodId] = useState<string | null>(null)

  // ==================== LOAD USER ====================

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      if (!user) throw new Error('User not authenticated')

      setUserId(user.id)
      setUserEmail(user.email || '')
      setEmailData(prev => ({ ...prev, email: user.email || '' }))
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }

  // ==================== SETUP METHODS ====================

  const setupTOTP = async () => {
    if (!userId || !userEmail) return

    setLoading(true)
    setError(null)

    try {
      const result = await mfaService.setupTOTP(userId, userEmail)
      if (!result.success || !result.totpData) {
        throw new Error(result.error || 'Failed to setup TOTP')
      }

      setTotpData(result.totpData)
      setSetupMethodId(result.methodId!)
      setCurrentStep('verify')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const setupSMS = async () => {
    if (!userId || !smsData.phoneNumber) {
      setError('Please enter a phone number')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await mfaService.setupSMS(userId, smsData.phoneNumber)
      if (!result.success) {
        throw new Error(result.error || 'Failed to setup SMS')
      }

      setSetupMethodId(result.methodId!)
      setCurrentStep('verify')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const setupEmail = async () => {
    if (!userId || !emailData.email) {
      setError('Please enter an email address')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await mfaService.setupEmail(userId, emailData.email)
      if (!result.success) {
        throw new Error(result.error || 'Failed to setup email')
      }

      setSetupMethodId(result.methodId!)
      setCurrentStep('verify')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  // ==================== VERIFICATION ====================

  const verifyCode = async () => {
    if (!setupMethodId || !verificationCode) {
      setError('Please enter the verification code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let result
      switch (selectedMethod) {
        case 'totp':
          result = await mfaService.verifyTOTP(setupMethodId, verificationCode)
          break
        case 'sms':
          result = await mfaService.verifySMS(setupMethodId, verificationCode)
          break
        case 'email':
          result = await mfaService.verifyEmail(setupMethodId, verificationCode)
          break
        default:
          throw new Error('Invalid method')
      }

      if (!result.success) {
        throw new Error(result.error || 'Invalid verification code')
      }

      // Generate backup codes
      await generateBackupCodes()
      setCurrentStep('backup-codes')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const generateBackupCodes = async () => {
    if (!userId) return

    try {
      const result = await mfaService.generateBackupCodes(userId)
      if (!result.success || !result.codes) {
        throw new Error(result.error || 'Failed to generate backup codes')
      }

      setBackupCodes({ codes: result.codes })
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }

  // ==================== NAVIGATION ====================

  const handleMethodSelection = (method: MFAMethodType) => {
    setSelectedMethod(method)
    switch (method) {
      case 'totp':
        setCurrentStep('totp-setup')
        break
      case 'sms':
        setCurrentStep('sms-setup')
        break
      case 'email':
        setCurrentStep('email-setup')
        break
    }
  }

  const handleBack = () => {
    setError(null)
    switch (currentStep) {
      case 'totp-setup':
      case 'sms-setup':
      case 'email-setup':
        setCurrentStep('method-selection')
        setSelectedMethod(null)
        break
      case 'verify':
        if (selectedMethod === 'totp') setCurrentStep('totp-setup')
        else if (selectedMethod === 'sms') setCurrentStep('sms-setup')
        else if (selectedMethod === 'email') setCurrentStep('email-setup')
        break
      case 'backup-codes':
        setCurrentStep('verify')
        break
    }
  }

  const handleComplete = () => {
    setCurrentStep('complete')
    if (onComplete) {
      setTimeout(() => onComplete(), 2000)
    }
  }

  // ==================== UTILITIES ====================

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const downloadBackupCodes = () => {
    if (!backupCodes) return

    const content = `LOANZ360 MFA Backup Codes
Generated: ${new Date().toLocaleString()}
User: ${userEmail}

KEEP THESE CODES SAFE!
Each code can only be used once.

${backupCodes.codes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

Store these codes in a secure location.
Do not share them with anyone.
`

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `loanz360-backup-codes-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ==================== RENDER STEPS ====================

  const renderMethodSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Multi-Factor Authentication</h2>
        <p className="text-gray-600">Choose your preferred authentication method to secure your account</p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => handleMethodSelection('totp')}
          className="w-full p-6 text-left border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200">
                <Smartphone className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Authenticator App</h3>
                <p className="text-sm text-gray-600">Use Google Authenticator, Authy, or similar apps</p>
                <span className="inline-block mt-1 px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded">
                  Recommended
                </span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          onClick={() => handleMethodSelection('sms')}
          className="w-full p-6 text-left border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200">
                <Smartphone className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">SMS Text Message</h3>
                <p className="text-sm text-gray-600">Receive codes via text message</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          onClick={() => handleMethodSelection('email')}
          className="w-full p-6 text-left border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200">
                <Mail className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Email</h3>
                <p className="text-sm text-gray-600">Receive codes via email</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
          </div>
        </button>
      </div>
    </div>
  )

  const renderTOTPSetup = () => (
    <div className="space-y-6">
      <div className="text-center">
        <QrCode className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Authenticator App</h2>
        <p className="text-gray-600">Scan the QR code with your authenticator app</p>
      </div>

      {!totpData ? (
        <div className="text-center py-8">
          <button
            onClick={setupTOTP}
            disabled={loading}
            className="px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate QR Code'
            )}
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white p-8 rounded-lg border-2 border-gray-200 text-center">
            <div className="inline-block p-4 bg-white rounded-lg shadow-lg">
              <img
                src={totpData.qrCodeUrl}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Scan this QR code with your authenticator app
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-900 mb-2">Can't scan the QR code?</p>
            <p className="text-sm text-gray-600 mb-2">Enter this code manually:</p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded">
                {totpData.secret}
              </code>
              <button
                onClick={() => copyToClipboard(totpData.secret)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={() => setCurrentStep('verify')}
            className="w-full px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Continue to Verification
            <ArrowRight className="w-5 h-5 inline ml-2" />
          </button>
        </>
      )}

      <button
        onClick={handleBack}
        className="w-full px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <ArrowLeft className="w-5 h-5 inline mr-2" />
        Back
      </button>
    </div>
  )

  const renderSMSSetup = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Smartphone className="w-16 h-16 text-purple-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup SMS Authentication</h2>
        <p className="text-gray-600">Enter your phone number to receive verification codes</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number
        </label>
        <input
          type="tel"
          value={smsData.phoneNumber}
          onChange={e => setSmsData({ ...smsData, phoneNumber: e.target.value })}
          placeholder="+1234567890"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-2 text-sm text-gray-600">
          Enter phone number in international format (e.g., +1234567890)
        </p>
      </div>

      <button
        onClick={setupSMS}
        disabled={loading || !smsData.phoneNumber}
        className="w-full px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
            Sending Code...
          </>
        ) : (
          <>
            Send Verification Code
            <ArrowRight className="w-5 h-5 inline ml-2" />
          </>
        )}
      </button>

      <button
        onClick={handleBack}
        className="w-full px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <ArrowLeft className="w-5 h-5 inline mr-2" />
        Back
      </button>
    </div>
  )

  const renderEmailSetup = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Mail className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Email Authentication</h2>
        <p className="text-gray-600">Receive verification codes via email</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Address
        </label>
        <input
          type="email"
          value={emailData.email}
          onChange={e => setEmailData({ ...emailData, email: e.target.value })}
          placeholder="your@email.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <button
        onClick={setupEmail}
        disabled={loading || !emailData.email}
        className="w-full px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
            Sending Code...
          </>
        ) : (
          <>
            Send Verification Code
            <ArrowRight className="w-5 h-5 inline ml-2" />
          </>
        )}
      </button>

      <button
        onClick={handleBack}
        className="w-full px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <ArrowLeft className="w-5 h-5 inline mr-2" />
        Back
      </button>
    </div>
  )

  const renderVerification = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Code</h2>
        <p className="text-gray-600">
          {selectedMethod === 'totp' && 'Enter the 6-digit code from your authenticator app'}
          {selectedMethod === 'sms' && `We sent a code to ${smsData.phoneNumber}`}
          {selectedMethod === 'email' && `We sent a code to ${emailData.email}`}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Verification Code
        </label>
        <input
          type="text"
          value={verificationCode}
          onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-widest"
          maxLength={6}
        />
        <p className="mt-2 text-sm text-gray-600 text-center">
          Enter the 6-digit code
        </p>
      </div>

      <button
        onClick={verifyCode}
        disabled={loading || verificationCode.length !== 6}
        className="w-full px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            Verify Code
            <ArrowRight className="w-5 h-5 inline ml-2" />
          </>
        )}
      </button>

      <button
        onClick={handleBack}
        className="w-full px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <ArrowLeft className="w-5 h-5 inline mr-2" />
        Back
      </button>
    </div>
  )

  const renderBackupCodes = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Key className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Save Your Backup Codes</h2>
        <p className="text-gray-600">
          Use these codes if you lose access to your primary authentication method
        </p>
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Important:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Each code can only be used once</li>
              <li>Store these codes in a secure location</li>
              <li>Do not share them with anyone</li>
            </ul>
          </div>
        </div>
      </div>

      {backupCodes && (
        <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
          <div className="grid grid-cols-2 gap-3">
            {backupCodes.codes.map((code, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 font-mono text-sm bg-gray-50 px-3 py-2 rounded"
              >
                <span className="text-gray-400">{index + 1}.</span>
                <span className="font-medium">{code}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={() => backupCodes && copyToClipboard(backupCodes.codes.join('\n'))}
          className="flex-1 px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Copy className="w-5 h-5 inline mr-2" />
          {copied ? 'Copied!' : 'Copy Codes'}
        </button>
        <button
          onClick={downloadBackupCodes}
          className="flex-1 px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-5 h-5 inline mr-2" />
          Download
        </button>
      </div>

      <button
        onClick={handleComplete}
        className="w-full px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        I've Saved My Backup Codes
        <ArrowRight className="w-5 h-5 inline ml-2" />
      </button>
    </div>
  )

  const renderComplete = () => (
    <div className="text-center space-y-6 py-8">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <Check className="w-10 h-10 text-green-600" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete!</h2>
        <p className="text-gray-600">
          Your account is now protected with multi-factor authentication
        </p>
      </div>
      <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <span>MFA is now active on your account</span>
      </div>
    </div>
  )

  // ==================== MAIN RENDER ====================

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { id: 'method-selection', label: 'Method' },
              { id: 'setup', label: 'Setup' },
              { id: 'verify', label: 'Verify' },
              { id: 'backup-codes', label: 'Backup' },
              { id: 'complete', label: 'Done' }
            ].map((step, index, array) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                      currentStep === step.id ||
                      (step.id === 'setup' && ['totp-setup', 'sms-setup', 'email-setup'].includes(currentStep)) ||
                      currentStep === 'complete'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className="text-xs mt-2 text-gray-600">{step.label}</span>
                </div>
                {index < array.length - 1 && (
                  <div className="flex-1 h-0.5 bg-gray-200 mx-2 mt-[-24px]" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step Content */}
        {currentStep === 'method-selection' && renderMethodSelection()}
        {currentStep === 'totp-setup' && renderTOTPSetup()}
        {currentStep === 'sms-setup' && renderSMSSetup()}
        {currentStep === 'email-setup' && renderEmailSetup()}
        {currentStep === 'verify' && renderVerification()}
        {currentStep === 'backup-codes' && renderBackupCodes()}
        {currentStep === 'complete' && renderComplete()}
      </div>
    </div>
  )
}
