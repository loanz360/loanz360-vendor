/**
 * 2FA Verification Component
 * Simple component for verifying 2FA codes during login or sensitive operations
 */

'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Shield, RefreshCw, AlertCircle } from 'lucide-react'
import { fetchWithErrorHandling, showErrorToast } from '@/lib/errors/client-errors'

interface TwoFAVerifyProps {
  adminId: string
  onVerified?: (deviceTrusted: boolean) => void
  onCancel?: () => void
  showTrustDevice?: boolean
  showBackupOption?: boolean
}

export function TwoFAVerify({
  adminId,
  onVerified,
  onCancel,
  showTrustDevice = true,
  showBackupOption = true,
}: TwoFAVerifyProps) {
  const [code, setCode] = React.useState('')
  const [trustDevice, setTrustDevice] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [useBackupCode, setUseBackupCode] = React.useState(false)

  const handleVerify = async () => {
    if (!code || code.length < 6) {
      setError('Please enter a valid verification code')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchWithErrorHandling(`/api/admin-management/${adminId}/2fa`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: code,
          trustDevice,
        }),
      })

      if (result.success) {
        onVerified?.(trustDevice)
      } else {
        setError(result.error || 'Invalid verification code. Please try again.')
      }
    } catch (error) {
      setError('An error occurred while verifying. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleVerify()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center mb-6">
        <div className="rounded-full bg-blue-100 p-3">
          <Shield className="h-8 w-8 text-blue-600" />
        </div>
      </div>

      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Two-Factor Authentication Required
        </h3>
        <p className="text-sm text-gray-600">
          {useBackupCode
            ? 'Enter one of your backup codes'
            : 'Enter the 6-digit code from your authenticator app'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="verification-code">
          {useBackupCode ? 'Backup Code' : 'Verification Code'}
        </Label>
        <Input
          id="verification-code"
          type="text"
          placeholder={useBackupCode ? 'XXXXXXXX' : '000000'}
          maxLength={useBackupCode ? 8 : 6}
          value={code}
          onChange={(e) => {
            setCode(useBackupCode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))
            setError(null)
          }}
          onKeyPress={handleKeyPress}
          className="text-center text-2xl tracking-widest font-mono"
          autoFocus
          disabled={isLoading}
        />
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {showTrustDevice && !useBackupCode && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="trust-device"
            checked={trustDevice}
            onCheckedChange={(checked) => setTrustDevice(checked as boolean)}
            disabled={isLoading}
          />
          <label
            htmlFor="trust-device"
            className="text-sm text-gray-700 cursor-pointer select-none"
          >
            Trust this device for 30 days
          </label>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button
          onClick={handleVerify}
          disabled={isLoading || code.length < (useBackupCode ? 8 : 6)}
          className="w-full"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify'
          )}
        </Button>

        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isLoading} className="w-full">
            Cancel
          </Button>
        )}
      </div>

      {showBackupOption && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setUseBackupCode(!useBackupCode)
              setCode('')
              setError(null)
            }}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            disabled={isLoading}
          >
            {useBackupCode
              ? 'Use authenticator app instead'
              : 'Lost your device? Use a backup code'}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * 2FA Status Badge
 * Shows whether 2FA is enabled for an admin
 */
interface TwoFAStatusBadgeProps {
  isEnabled: boolean
  isLocked?: boolean
  variant?: 'default' | 'compact'
}

export function TwoFAStatusBadge({ isEnabled, isLocked = false, variant = 'default' }: TwoFAStatusBadgeProps) {
  if (variant === 'compact') {
    return (
      <div className="inline-flex items-center">
        {isEnabled ? (
          <Shield className="h-3 w-3 text-green-600" />
        ) : (
          <Shield className="h-3 w-3 text-gray-400" />
        )}
      </div>
    )
  }

  if (isLocked) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
        <AlertCircle className="h-3 w-3" />
        <span>Locked</span>
      </div>
    )
  }

  if (isEnabled) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
        <Shield className="h-3 w-3" />
        <span>2FA Enabled</span>
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
      <Shield className="h-3 w-3" />
      <span>2FA Disabled</span>
    </div>
  )
}

/**
 * 2FA Required Indicator
 * Shows when an action requires 2FA verification
 */
export function TwoFARequiredIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 border border-blue-200">
      <Shield className="h-3 w-3" />
      <span>2FA Required</span>
    </div>
  )
}
