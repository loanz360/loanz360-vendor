/**
 * 2FA Setup Component
 * Handles the complete 2FA setup and management flow
 */

'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useConfirmationDialog, ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Key,
  Smartphone,
  Copy,
  Check,
  AlertTriangle,
  QrCode,
  RefreshCw,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react'
import { fetchWithErrorHandling, showErrorToast, showSuccessToast } from '@/lib/errors/client-errors'

interface TwoFASetupProps {
  adminId: string
  adminName: string
  adminEmail: string
  onStatusChange?: (isEnabled: boolean) => void
}

interface TwoFAStatus {
  isEnabled: boolean
  enabledAt: string | null
  lastVerifiedAt: string | null
  backupCodesGeneratedAt: string | null
  backupCodesCount: number
  trustedDevicesCount: number
  isLocked: boolean
  lockedUntil: string | null
  failedAttempts: number
}

interface SetupData {
  secret: string
  qrCodeUri: string
  qrCodeUrl: string
  accountName: string
}

export function TwoFASetup({ adminId, adminName, adminEmail, onStatusChange }: TwoFASetupProps) {
  const [status, setStatus] = React.useState<TwoFAStatus | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [setupData, setSetupData] = React.useState<SetupData | null>(null)
  const [verificationCode, setVerificationCode] = React.useState('')
  const [backupCodes, setBackupCodes] = React.useState<string[]>([])
  const [showBackupCodes, setShowBackupCodes] = React.useState(false)
  const [copiedSecret, setCopiedSecret] = React.useState(false)
  const [copiedCodes, setCopiedCodes] = React.useState(false)
  const { isOpen, config, openDialog, closeDialog } = useConfirmationDialog()

  React.useEffect(() => {
    fetchStatus()
  }, [adminId])

  const fetchStatus = async () => {
    setIsLoading(true)
    try {
      const result = await fetchWithErrorHandling(`/api/admin-management/${adminId}/2fa`)

      if (result.success && result.data) {
        setStatus(result.data.twoFA)
      }
    } catch (error) {
      showErrorToast('Failed to load 2FA status')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartSetup = async () => {
    setIsLoading(true)
    try {
      const result = await fetchWithErrorHandling(`/api/admin-management/${adminId}/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      })

      if (result.success && result.data) {
        setSetupData(result.data)
        showSuccessToast('2FA setup initiated. Please scan the QR code with your authenticator app.')
      } else {
        showErrorToast(result.error || 'Failed to start 2FA setup')
      }
    } catch (error) {
      showErrorToast('An error occurred while starting 2FA setup')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showErrorToast('Please enter a valid 6-digit verification code')
      return
    }

    setIsLoading(true)
    try {
      const result = await fetchWithErrorHandling(`/api/admin-management/${adminId}/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enable',
          token: verificationCode,
        }),
      })

      if (result.success && result.data) {
        setBackupCodes(result.data.backupCodes || [])
        setShowBackupCodes(true)
        setSetupData(null)
        setVerificationCode('')
        await fetchStatus()
        onStatusChange?.(true)
        showSuccessToast('2FA enabled successfully! Please save your backup codes.')
      } else {
        showErrorToast(result.error || 'Failed to enable 2FA. Please check your code and try again.')
      }
    } catch (error) {
      showErrorToast('An error occurred while enabling 2FA')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisable2FA = () => {
    openDialog({
      action: 'custom',
      title: 'Disable Two-Factor Authentication',
      description: `Are you sure you want to disable 2FA for ${adminName}? This will make the account less secure.`,
      details: [
        'All trusted devices will be revoked',
        'Backup codes will no longer work',
        'You will need to set up 2FA again if you want to re-enable it',
      ],
      confirmText: 'Disable 2FA',
      cancelText: 'Cancel',
      variant: 'destructive',
      requiresInput: true,
      inputPlaceholder: 'Enter verification code',
      onConfirm: async (code?: string) => {
        if (!code || code.length !== 6) {
          showErrorToast('Please enter a valid 6-digit verification code')
          return
        }

        setIsLoading(true)
        try {
          const result = await fetchWithErrorHandling(`/api/admin-management/${adminId}/2fa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'disable',
              token: code,
            }),
          })

          if (result.success) {
            await fetchStatus()
            onStatusChange?.(false)
            showSuccessToast('2FA disabled successfully')
            closeDialog()
          } else {
            showErrorToast(result.error || 'Failed to disable 2FA')
          }
        } catch (error) {
          showErrorToast('An error occurred while disabling 2FA')
        } finally {
          setIsLoading(false)
        }
      },
    })
  }

  const handleRegenerateBackupCodes = () => {
    openDialog({
      action: 'custom',
      title: 'Regenerate Backup Codes',
      description: 'This will invalidate all existing backup codes and generate new ones.',
      details: [
        'Previous backup codes will no longer work',
        'You must save the new codes in a secure location',
        'These codes can be used if you lose access to your authenticator app',
      ],
      confirmText: 'Regenerate Codes',
      cancelText: 'Cancel',
      variant: 'warning',
      requiresInput: true,
      inputPlaceholder: 'Enter verification code',
      onConfirm: async (code?: string) => {
        if (!code || code.length !== 6) {
          showErrorToast('Please enter a valid 6-digit verification code')
          return
        }

        setIsLoading(true)
        try {
          const result = await fetchWithErrorHandling(`/api/admin-management/${adminId}/2fa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'regenerate-backup-codes',
              token: code,
            }),
          })

          if (result.success && result.data) {
            setBackupCodes(result.data.backupCodes || [])
            setShowBackupCodes(true)
            await fetchStatus()
            showSuccessToast('Backup codes regenerated successfully')
            closeDialog()
          } else {
            showErrorToast(result.error || 'Failed to regenerate backup codes')
          }
        } catch (error) {
          showErrorToast('An error occurred while regenerating backup codes')
        } finally {
          setIsLoading(false)
        }
      },
    })
  }

  const copyToClipboard = async (text: string, type: 'secret' | 'codes') => {
    try {
      await navigator.clipboard.writeText(text)

      if (type === 'secret') {
        setCopiedSecret(true)
        setTimeout(() => setCopiedSecret(false), 2000)
      } else {
        setCopiedCodes(true)
        setTimeout(() => setCopiedCodes(false), 2000)
      }

      showSuccessToast('Copied to clipboard')
    } catch (error) {
      showErrorToast('Failed to copy to clipboard')
    }
  }

  const downloadBackupCodes = () => {
    const text = `LOANZ 360 - Two-Factor Authentication Backup Codes\n\nAdmin: ${adminName}\nEmail: ${adminEmail}\nGenerated: ${new Date().toLocaleString()}\n\nBackup Codes (use each code only once):\n\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\n⚠️ IMPORTANT:\n- Store these codes in a secure location\n- Each code can only be used once\n- These codes can be used if you lose access to your authenticator app\n- If you suspect these codes have been compromised, regenerate them immediately`

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `loanz360-2fa-backup-codes-${adminEmail}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showSuccessToast('Backup codes downloaded')
  }

  if (isLoading && !status) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading 2FA status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show backup codes screen
  if (showBackupCodes && backupCodes.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Backup Codes
          </CardTitle>
          <CardDescription>
            Save these backup codes in a secure location. Each code can only be used once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900">Important - Save These Codes</p>
                <p className="mt-1 text-sm text-yellow-700">
                  These codes can be used to access your account if you lose your authenticator device. Each code can
                  only be used once. Store them in a safe place.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {backupCodes.map((code, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3 font-mono text-sm"
              >
                <span className="text-gray-600 mr-2">{index + 1}.</span>
                <span className="font-semibold">{code}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => copyToClipboard(backupCodes.join('\n'), 'codes')} className="flex-1">
              {copiedCodes ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copiedCodes ? 'Copied!' : 'Copy All'}
            </Button>
            <Button variant="outline" onClick={downloadBackupCodes} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          <Button onClick={() => setShowBackupCodes(false)} className="w-full">
            I've Saved These Codes
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Show setup screen
  if (setupData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Set Up Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code */}
          <div className="flex flex-col items-center space-y-4">
            <div className="rounded-lg border-2 border-gray-200 p-4 bg-white">
              <img src={setupData.qrCodeUrl} alt="2FA QR Code" className="w-64 h-64" />
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Can't scan? Enter this code manually:</p>
              <div className="flex items-center gap-2 justify-center">
                <code className="rounded bg-gray-100 px-3 py-2 font-mono text-sm">{setupData.secret}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(setupData.secret, 'secret')}
                >
                  {copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Verification Code Input */}
          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <Input
              id="verification-code"
              type="text"
              placeholder="000000"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest font-mono"
            />
            <p className="text-xs text-gray-500">Enter the 6-digit code from your authenticator app</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSetupData(null)
                setVerificationCode('')
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyAndEnable}
              disabled={isLoading || verificationCode.length !== 6}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Enable 2FA
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show status and management screen
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {status?.isEnabled ? (
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                ) : (
                  <ShieldOff className="h-5 w-5 text-gray-400" />
                )}
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>
                {status?.isEnabled
                  ? 'Add an extra layer of security to your account'
                  : 'Protect your account with 2FA'}
              </CardDescription>
            </div>
            <Badge variant={status?.isEnabled ? 'default' : 'secondary'}>
              {status?.isEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.isLocked && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Account Locked</p>
                  <p className="mt-1 text-sm text-red-700">
                    Too many failed verification attempts. Please try again later.
                  </p>
                </div>
              </div>
            </div>
          )}

          {status?.isEnabled ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="h-4 w-4 text-gray-600" />
                    <p className="text-sm font-medium text-gray-900">Backup Codes</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{status.backupCodesCount}</p>
                  <p className="text-xs text-gray-500 mt-1">remaining</p>
                </div>

                <div className="rounded-lg border bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="h-4 w-4 text-gray-600" />
                    <p className="text-sm font-medium text-gray-900">Trusted Devices</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{status.trustedDevicesCount}</p>
                  <p className="text-xs text-gray-500 mt-1">active</p>
                </div>

                <div className="rounded-lg border bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-gray-600" />
                    <p className="text-sm font-medium text-gray-900">Status</p>
                  </div>
                  <p className="text-sm font-semibold text-green-600">Protected</p>
                  {status.lastVerifiedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last verified: {new Date(status.lastVerifiedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRegenerateBackupCodes} disabled={isLoading}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate Backup Codes
                </Button>
                <Button variant="destructive" onClick={handleDisable2FA} disabled={isLoading}>
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Disable 2FA
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-900">
                  Two-factor authentication adds an extra layer of security to your account by requiring a verification
                  code in addition to your password.
                </p>
              </div>

              <Button onClick={handleStartSetup} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Enable Two-Factor Authentication
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={isOpen}
        onOpenChange={closeDialog}
        onConfirm={config.onConfirm || (() => {})}
        {...config}
      />
    </>
  )
}
